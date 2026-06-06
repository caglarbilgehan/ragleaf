# 🚀 Ragleaf Platform — İlerleme Raporu

> **Son Güncelleme:** 2026-06-06
> **Proje Başlangıcı:** 2025-11-09 (V05.0.0)
> **Mevcut Sürüm:** V05.1.0

---

## 📊 Genel Durum Özeti

| Metrik | Değer |
|--------|-------|
| 🏗️ Toplam Tamamlanan Görev | 22 |
| ⏳ Bekleyen Görev | 0 |
| 📝 İşlenen Prompt | 19 |
| 🧪 Başarılı Test | 36 |
| ❌ Başarısız Test | 0 |
| ⏳ Bekleyen Manuel Test | 3 |
| 🐳 Aktif Docker Servis | 8 |
| 📂 Toplam Değişen Dosya | ~75+ |

---

## 🗺️ Yol Haritası & Kilometre Taşları

### ✅ V05.0.0 — Hibrit Vector Store Mimarisi (2025-11-09)
- Chroma + FAISS hibrit vector store
- EnsembleRetriever (Chroma 30% + FAISS 70%)
- BGE Reranker desteği
- Migration scriptleri
- **Durum:** ✅ TAMAMLANDI

### ✅ V05.1.0 — Advanced Document Reset & Reprocess (2026-01-13)
- 3 seviyeli reset sistemi (hafif/orta/tam)
- Granular reset options
- SSE ile real-time progress tracking
- Auto-process & auto-index
- **Durum:** ✅ TAMAMLANDI

### ✅ GÖREV-1 — Landing Page Buton Stilleri (2026-06-02)
- Giriş Yap & Şimdi Başla butonları unified stile geçirildi
- Hover efektleri standardize edildi
- Docker landing-page rebuild
- **Durum:** ✅ TAMAMLANDI
- **Kaynak Prompt:** #1

### ✅ GÖREV-2 — Sektörel Hazır AI Asistan Şablonları (2026-06-02)
- 4 sektör şablonu: kuaför, diş hekimi, e-ticaret, restoran
- Randevu sistemi (DB + API + AI chat entegrasyonu)
- Google Calendar OAuth2 + iCal feed
- Template Wizard (3 adımlı) + Appointments Dashboard
- **Durum:** ✅ TAMAMLANDI
- **Kaynak Prompt:** #2
- **Commitler:** fb30565, 8974eb7, 30dd30e, a1e351c, 270dcb6

### ✅ GÖREV-3 — Admin Paneli Refaktör (2026-06-02)
- Dökümanlar ve Kullanıcılar menüsü kaldırıldı
- Tenantlar sayfası (KVKK kontrollü doküman erişimi + tab'lı detay)
- Şablon Yönetimi sayfası eklendi
- **Durum:** ✅ TAMAMLANDI
- **Kaynak Prompt:** #3

### ✅ GÖREV-5 — AI/LLM Yapılandırma Yönetim Paneline Taşıma (2026-06-02)
- Global AI config endpoint'leri (backend)
- Admin "AI Yapılandırma" sayfası (LLM Model + RAG)
- Agent builder'dan Model & RAG sekmesi kaldırıldı
- Agent oluşturma global config'den besleniyor
- **Durum:** ✅ TAMAMLANDI
- **Kaynak Prompt:** #5

### ✅ GÖREV-6 — Varsayılan Panel → Müşteri Paneli (2026-06-02)
- Root route `/` → `/tenant` yönlendirme
- viewMode default `'tenant'`
- Admin route auto-detect (useEffect)
- **Durum:** ✅ TAMAMLANDI
- **Kaynak Prompt:** #6

### ✅ GÖREV-7 — Landing Page Mobil Uyum + Widget Auto-Open (2026-06-02)
- Hamburger menü CSS class-based toggle
- Kapsamlı responsive iyileştirmeler (padding, font, layout)
- Widget autoOpen varsayılan true
- Agent builder'ında "Otomatik Aç" toggle
- **Durum:** ✅ TAMAMLANDI
- **Kaynak Prompt:** #7

### ✅ Hibrit RAG/LLM + Widget Markdown + DB Fixes (2026-06-03)
- Hibrit RAG/LLM yanıt sistemi (`public_chat.py` — doküman yoksa bile yanıt)
- DB model activation fix (`models.is_active`, `agents.model_config_data`)
- LLM Router bug fix (NULL handling, rollback prevention)
- Widget markdown render desteği (`parseMarkdown()` metodu)
- Dockerfile optimizasyonu (3-stage build: Python + Node Alpine + Production)
- **Durum:** ✅ TAMAMLANDI
- **Kaynak Prompt:** #8, #9

### ✅ GÖREV-9 — Console Hataları Düzeltme (2026-06-03)
- Admin panelindeki 7 adet 500/404/401 console hatası çözüldü
- **Durum:** ✅ TAMAMLANDI
- **Kaynak Prompt:** #10

### ✅ GÖREV-10 — Admin Paneli Temizlik (2026-06-03)
- Chunk/Enrichment/Test/Analytics sayfaları ve sidebar linkleri kaldırıldı
- **Durum:** ✅ TAMAMLANDI
- **Kaynak Prompt:** #10

### ✅ GÖREV-11 — Agent Bazlı Döküman Yönetimi (2026-06-03)
- Admin panelden şablon asistanları için döküman yükleme UI
- Tenant panelden asistan bazlı döküman yükleme UI
- Döküman paylaşımı, silme (paylaşımlı/izole) ve işleme pipeline entegrasyonu
- **Durum:** ✅ TAMAMLANDI
- **Kaynak Prompt:** #10

### ✅ GÖREV-8 — Randevu Hatırlatma Sistemi (2026-06-03)
- E-posta ve SMS yoluyla otomatik hatırlatma
- SMTP (Email) & Twilio/NetGSM (SMS) & Mock Fallback servisleri
- FastAPI lifespan background task scheduler loop ve region kontrolü
- **Durum:** ✅ TAMAMLANDI
- **Kaynak Prompt:** #10

### ✅ GÖREV-12 — Tenant Döküman İzleme & Log Sistemi (2026-06-03)
- Kalite Skoru (Heuristics) hesaplama algoritması ve suggestions desteği
- Endpoint `/api/agents/{agent_id}/documents/{document_id}/details` (Logs + Score + Health)
- circular progress bar / circular gauge, log timeline ve sistem sağlık paneli ile premium React modal arayüzü
- **Durum:** ✅ TAMAMLANDI
- **Kaynak Prompt:** #10

### ✅ GÖREV-60 — Küresel Sayfa Düzeni (Layout) Standardizasyonu (2026-06-05)
- Ragleaf AI Asistanı tüm sayfalarda sağ sidebar (400px) olarak gösterildi.
- Header, sayfa içeriği ve Footer sol sütuna yerleştirildi ve sağdan 400px pay bırakıldı.
- Mobil görünümde asistanın floating widget/drawer olarak çalışması korundu.
- **Durum:** ✅ TAMAMLANDI
- **Kaynak Prompt:** #10

### ✅ GÖREV-61 — Geliştiriciler Sayfası Sol Menü Sticky Yapısı (2026-06-06)
- Sol taraftaki menünün aşağı kaydırmalarda yapışkan (sticky) kalmasını engelleyen medya sorguları ve body sınıf ezecek kurallar temizlendi.
- **Durum:** ✅ TAMAMLANDI

### ✅ GÖREV-62 — Asistan Fallback Yanıt Hatası Giderilmesi (2026-06-06)
- Asistan mesajlarının backend'de HuggingFace router'a `'bot'` rolüyle gönderilmesi sebebiyle oluşan `400 Bad Request` hatası, frontend ve backend'de rol normalleştirmesiyle giderildi.
- **Durum:** ✅ TAMAMLANDI

---

## ⏳ Devam Eden / Bekleyen İşler

### 🟢 Tüm Görevler Tamamlandı!
- Devam eden veya bekleyen herhangi bir aktif görev bulunmamaktadır.

### ⏳ Bekleyen Manuel Testler
- [ ] Widget embed testi (harici HTML sayfasında)
- [ ] Multi-tenant izolasyon testi (farklı org_slug ile)
- [ ] Google Calendar entegrasyon testi

---

## 🐳 Canlı Servis Durumları

| Servis | Port | Son Durum |
|--------|------|-----------|
| API Gateway | 1306 | ✅ Healthy |
| Platform | 1307 | ✅ HTTP 200 |
| Landing Page | 1301 | ✅ HTTP 200 |
| MinIO | 1308 | ✅ HTTP 200 |
| PostgreSQL | 1300 | ✅ Healthy |
| Redis | 1303 | ✅ Healthy |
| Embedding | 1305 | ✅ Healthy |
| OCR | 1304 | ✅ Healthy |

---

## 📝 Prompt Geçmişi

| # | Başlık | Tarih | Durum |
|---|--------|-------|-------|
| 1 | Landing Page Buton Hover Efektleri | 2026-06-02 | ✅ Tamamlandı |
| 2 | Sektörel Hazır AI Asistan Şablonları | 2026-06-02 | ✅ Tamamlandı |
| 3 | Admin Paneli Refaktör | 2026-06-02 | ✅ Tamamlandı |
| 4 | İlerleme Takip & Arşivleme Sistemi Kurulumu | 2026-06-02 | ✅ Tamamlandı |
| 5 | AI/LLM Yapılandırma Yönetim Paneline Taşıma | 2026-06-02 | ✅ Tamamlandı |
| 6 | Varsayılan Panel → Müşteri Paneli | 2026-06-02 | ✅ Tamamlandı |
| 7 | Landing Page Mobil Uyum + Widget Auto-Open | 2026-06-02 | ✅ Tamamlandı |
| 8 | Hibrit RAG/LLM Yanıt Sistemi | 2026-06-03 | ✅ Tamamlandı |
| 9 | Widget Markdown Render Desteği | 2026-06-03 | ✅ Tamamlandı |
| 10 | Console Hataları + Admin Temizlik + Döküman Sistemi | 2026-06-03 | ✅ Tamamlandı |
| 11 | Proje Analizi ve Detaylı Değerlendirme | 2026-06-05 | ✅ Tamamlandı |
| 12 | Next.js Landing Page Migration & Bug Fixes | 2026-06-05 | ✅ Tamamlandı |
| 13 | AI Writer Backend & Database Schema | 2026-06-05 | ✅ Tamamlandı |
| 14 | Next.js Blog Page Integration | 2026-06-05 | ✅ Tamamlandı |
| 15 | Unified Landing Folder & Route Renaming | 2026-06-05 | ✅ Tamamlandı |
| 16 | Küresel Sayfa Düzeni (Layout) Standardizasyonu | 2026-06-05 | ✅ Tamamlandı |
| 17 | Ragleaf Asistanı Fallback Yanıt Hatası | 2026-06-06 | ✅ Tamamlandı |


> Detaylar için: [`archive/PROMPTS-ARCHIVE/20260606.md`](file:///home/cserver/ragleaf/archive/PROMPTS-ARCHIVE/20260606.md)

---

## 📁 Dosya Sistemi Haritası (Takip Dosyaları)

```
ragleaf/
├── docs/
│   └── process/
│       ├── PROMPTS.md              ← 📥 Yeni promptlar buraya yazılır
│       ├── PROGRESS.md             ← 📊 Bu dosya (genel ilerleme)
│       ├── FUTURE-PLANS.md         ← 📋 Bekleyen görevler
│       └── TESTS.md                ← 🧪 Test sonuçları
├── archive/
│   ├── TASKS-ARCHIVE.md            ← 📦 Tamamlanan görev detayları
│   └── PROMPTS-ARCHIVE.md         ← 📝 İşlenen prompt arşivi
├── CHANGES.md                      ← 📋 Teknik changelog
├── VERSION.md                      ← 🏷️ Versiyon bilgisi
└── .agent/workflows/
    ├── remember.md                 ← /remember komutu
    ├── ultra.md                    ← /ultra komutu
    ├── think.md                    ← /think komutu
    └── together.md                 ← /together komutu
```

---

## 🔄 Güncelleme Protokolü

Bu dosya aşağıdaki durumlarda güncellenir:
1. **Yeni prompt alındığında** → Prompt Geçmişi tablosuna eklenir
2. **Görev tamamlandığında** → İlgili görev ✅ olarak işaretlenir
3. **Yeni görev oluşturulduğunda** → Devam Eden/Bekleyen İşler'e eklenir
4. **Servis durumu değiştiğinde** → Servis tablosu güncellenir
5. **Test sonucu geldiğinde** → Genel Durum metrikeri güncellenir

---

*Bu dosya otomatik olarak her /ultra, /remember çalıştığında güncellenir.*

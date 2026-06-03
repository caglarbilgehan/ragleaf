# 🚀 Ragleaf Platform — İlerleme Raporu

> **Son Güncelleme:** 2026-06-03
> **Proje Başlangıcı:** 2025-11-09 (V05.0.0)
> **Mevcut Sürüm:** V05.1.0

---

## 📊 Genel Durum Özeti

| Metrik | Değer |
|--------|-------|
| 🏗️ Toplam Tamamlanan Görev | 11 |
| ⏳ Bekleyen Görev | 3 |
| 📝 İşlenen Prompt | 12 |
| 🧪 Başarılı Test | 14 |
| ❌ Başarısız Test | 0 |
| ⏳ Bekleyen Manuel Test | 3 |
| 🐳 Aktif Docker Servis | 8 |
| 📂 Toplam Değişen Dosya | ~40+ |

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

---

## ⏳ Devam Eden / Bekleyen İşler

### 🔴 GÖREV-9 — Console Hataları Düzeltme
- **Öncelik:** 🔴 Yüksek
- **Tarih:** 2026-06-03
- **Alt görevler:** 7 adet 500/404/401 endpoint hatası

### 🔴 GÖREV-10 — Admin Paneli Temizlik (Chunk/Enrichment Kaldırma)
- **Öncelik:** 🔴 Yüksek
- **Tarih:** 2026-06-03

### 🔴 GÖREV-11 — Agent Bazlı Döküman Yönetimi
- **Öncelik:** 🔴 Yüksek
- **Tarih:** 2026-06-03

### 🟡 GÖREV-8 — Randevu Hatırlatma Sistemi
- **Öncelik:** 🟡 Orta
- **Tarih:** 2026-06-02

### 🟡 GÖREV-12 — Tenant Döküman İzleme & Log Sistemi
- **Öncelik:** 🟡 Orta
- **Tarih:** 2026-06-03

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
| 10 | Console Hataları + Admin Temizlik + Döküman Sistemi | 2026-06-03 | ⏳ FUTURE-PLANS |

> Detaylar için: [`archive/PROMPTS-ARCHIVE.md`](file:///home/cserver/ragleaf/archive/PROMPTS-ARCHIVE.md)

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
